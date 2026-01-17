import { createServer } from './server';
import { loadEnv } from './env';

const env = loadEnv();

const app = createServer(env);

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
