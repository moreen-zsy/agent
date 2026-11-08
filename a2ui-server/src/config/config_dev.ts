function trimSQ(envArgs: string | undefined) {
  if (!envArgs) return "";
  return envArgs.trim().replace(/^["']|["']$/g, "");
}

const rawPort = (process.env.PORT ?? "").trim();
const parsedPort = rawPort.length > 0 ? Number(rawPort) : Number.NaN;

const port =
  Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535
    ? parsedPort
    : 3000;

export default {
  port: port,
  JWT: {
    secret: trimSQ(process.env.JWT_SECRET),
  },
};
