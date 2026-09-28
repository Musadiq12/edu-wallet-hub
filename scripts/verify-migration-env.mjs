const required = [
  "SUPABASE_DB_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];

const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error("Missing migration environment variables:");
  for (const name of missing) console.error("- " + name);
  process.exit(1);
}

console.log("Migration environment looks complete. No secret values are printed.");
