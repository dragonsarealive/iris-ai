/** Copy IRIS_* env into OPENCODE_* when legacy key unset (IRIS wins for new installs). */
const env = process.env
for (const key of Object.keys(env)) {
  if (!key.startsWith("IRIS_")) continue
  const legacy = `OPENCODE_${key.slice(5)}`
  if (env[legacy] === undefined && env[key] !== undefined) env[legacy] = env[key]
}
