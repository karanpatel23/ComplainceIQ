import { readRepositoryConfig } from "../../config/src/index.js";
import { createRepository } from "./repository.js";
import { parseInitialAdminInput, provisionInitialAdmin } from "./provisioning.js";

const config = readRepositoryConfig(process.env);
const input = parseInitialAdminInput(process.env);
const repo = await createRepository(config);

try {
  const result = await provisionInitialAdmin(repo, input);
  console.error(`Initial administrator provisioned for ${result.organization.name}: ${result.admin.email}`);
} finally {
  await repo.close?.();
}
