import { createNestApp } from './bootstrap';

async function bootstrap() {
  const app = await createNestApp();
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
}

void bootstrap();
