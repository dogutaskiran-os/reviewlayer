import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApiApp } from "./server/app.mjs";
import { createStore } from "./server/store.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8787);
const databasePath = process.env.REVIEWLAYER_DATABASE_PATH || process.env.ANNOTE_DATABASE_PATH || path.join(root,"data","reviewlayer.db");
const store = createStore({ databasePath });
const app = express();

app.set("trust proxy", 1);
app.use(createApiApp({ store }));
app.use(express.static(path.join(root,"dist")));
app.get("*splat",(_request,response)=>response.sendFile(path.join(root,"dist","index.html")));

app.listen(port,()=>{
  console.log(`ReviewLayer listening on http://127.0.0.1:${port}`);
  console.log(`Database: ${databasePath}`);
});
