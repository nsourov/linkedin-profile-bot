import express from "express";
import bodyParser from "body-parser";

import { startScraper, resetDb, getInstance } from "./controllers";

const app = express();

// parse application/json
app.use(bodyParser.json());

app.post("/", startScraper);

app.delete("/reset", resetDb);

app.get("/instance/:instanceId", getInstance);

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`server is running on http://localhost:${port}`)
);
