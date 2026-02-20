insert into access_codes (code, partner_name, partner_tagline, partner_accent)
values
('246810','Terveystalo','Healthcare Services','#00b4d8'),
('135799','Terveystalo','Healthcare Services','#00b4d8'),
('112233','Mehiläinen','Healthcare & Wellbeing','#f5a623'),
('445566','Mehiläinen','Healthcare & Wellbeing','#f5a623'),
('778899','Lovnity Partner','Prototype Partner','#8b5cf6'),

-- Added later via pgAdmin (keep here so repo matches DB)
('990001','Terveystalo','Healthcare Services','#00b4d8'),
('990002','Terveystalo','Healthcare Services','#00b4d8'),
('990003','Mehiläinen','Healthcare & Wellbeing','#f5a623'),
('990004','Mehiläinen','Healthcare & Wellbeing','#f5a623'),
('990005','Lovnity Partner','Prototype Partner','#8b5cf6')

on conflict (code) do nothing;