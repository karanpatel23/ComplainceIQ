import { readConfig } from "../../config/src/index.js";
import { seedSyntheticPilot } from "./pilot-seed.js";

const result = await seedSyntheticPilot({ config: readConfig(process.env) });
process.stderr.write(`Synthetic pilot seed complete. Admin email: ${result.admin.email}; facilities: ${result.facilities.length}.\n`);
