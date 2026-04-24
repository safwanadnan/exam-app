import { prisma } from '../src/lib/prisma';
async function main() {
  const config = await prisma.solverConfig.findFirst();
  console.log(JSON.stringify(config, null, 2));
}
main();
