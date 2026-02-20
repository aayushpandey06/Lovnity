import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

/**
 * POST /check-code { code }
 * -> { status: "invalid" | "needs_registration" | "ok", partner?, profile? }
 */
app.post("/check-code", async (req, res) => {
  const code = String(req.body?.code ?? "").trim();
  if (code.length !== 6) return res.status(400).json({ error: "Invalid code" });

  const accessQ = await pool.query(
    `select code, partner_name, partner_tagline, partner_accent, is_claimed, claimed_profile_id
     from access_codes
     where code = $1`,
    [code]
  );

  if (accessQ.rows.length === 0) return res.json({ status: "invalid" });

  const a = accessQ.rows[0];

  // If already claimed, fetch profile details too
  if (a.is_claimed && a.claimed_profile_id) {
    const profileQ = await pool.query(
      `select id, first_name, surname, gender, age
       from profiles
       where id = $1`,
      [a.claimed_profile_id]
    );

    const p = profileQ.rows[0];

    return res.json({
      status: "ok",
      partner: { name: a.partner_name, tagline: a.partner_tagline, accent: a.partner_accent },
      profile: p
        ? {
            id: p.id,
            firstName: p.first_name,
            surname: p.surname,
            gender: p.gender,
            age: p.age,
          }
        : null,
    });
  }

  // Not claimed yet -> needs registration
  return res.json({
    status: "needs_registration",
    partner: { name: a.partner_name, tagline: a.partner_tagline, accent: a.partner_accent },
  });
});

/**
 * POST /register-with-code { code, firstName, surname, gender, age }
 * -> { status: "ok", profile_id, partner }
 */
app.post("/register-with-code", async (req, res) => {
  const code = String(req.body?.code ?? "").trim();
  const firstName = String(req.body?.firstName ?? "").trim();
  const surname = String(req.body?.surname ?? "").trim();
  const gender = String(req.body?.gender ?? "").trim();
  const age = Number(req.body?.age);

  if (code.length !== 6) return res.status(400).json({ error: "Invalid code" });
  if (!firstName || !surname || !gender || !Number.isFinite(age)) {
    return res.status(400).json({ error: "Missing/invalid fields" });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Lock the code row to avoid two users claiming it simultaneously
    const codeQ = await client.query(
      `select code, partner_name, partner_tagline, partner_accent, is_claimed
       from access_codes
       where code = $1
       for update`,
      [code]
    );

    if (codeQ.rows.length === 0) {
      await client.query("rollback");
      return res.status(404).json({ error: "Code not found" });
    }

    const codeRow = codeQ.rows[0];
    if (codeRow.is_claimed) {
      await client.query("rollback");
      return res.status(409).json({ error: "Code already used" });
    }

    const inserted = await client.query(
      `insert into profiles (code, first_name, surname, gender, age)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [code, firstName, surname, gender, age]
    );

    const profileId = inserted.rows[0].id;

    await client.query(
      `update access_codes
       set is_claimed = true, claimed_profile_id = $2
       where code = $1`,
      [code, profileId]
    );

    await client.query("commit");

    return res.json({
      status: "ok",
      profile_id: profileId,
      partner: { name: codeRow.partner_name, tagline: codeRow.partner_tagline, accent: codeRow.partner_accent },
    });
  } catch (e) {
    await client.query("rollback");
    return res.status(500).json({ error: String(e) });
  } finally {
    client.release();
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));