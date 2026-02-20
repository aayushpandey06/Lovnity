Use the command below in terminal after pull this repo in vs code. System is connected to docker so database of the dummy codes can be accessed.


docker compose up -d
docker exec -i lovnity-db psql -U postgres -d lovnity < server/schema.sql
docker exec -i lovnity-db psql -U postgres -d lovnity < server/seed.sql
cd server
npm install
npm run dev


And these are the test codes :
246810
135799
112233
445566
778899
990001
990002
990003
990004
990005
Each code canm be used only once cause it will register to the database.