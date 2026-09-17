import { app } from "./app";
import { env } from "./config/env";
import { startCobScheduler } from "./jobs/cobScheduler";

app.listen(env.port, () => {
  console.log(`Fintech core service layer listening on http://localhost:${env.port}`);
  startCobScheduler();
});
