# Exam App

A custom scheduling application built on Next.js and Prisma, with exam-solving logic inspired by the UniTime solver.

## Setup & Development 🔧

1. **Clone the repository** and install dependencies:

   ```bash
   git clone <repo-url>
   cd exam-app
   npm install     # or yarn / pnpm
   ```

2. **Configure environment variables** (see below).
3. **Initialize the database with Prisma** (commands listed in the next section).
4. **Start the development server**:

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000` by default.


## Prisma Commands 🛠️

This project uses Prisma for database access. After setting `DATABASE_URL` in your env file, run the following as needed:

```bash
# Generate the Prisma client (run after editing schema.prisma)
npx prisma generate

# Create/migrate the database schema (development mode)
npx prisma migrate dev --name init

# Push the model to the database without a migration (useful for simple changes)
npx prisma db push

# Open Prisma Studio (web UI for inspecting the database)
npx prisma studio
```

> **Tip:** If you change `schema.prisma`, always regenerate the client.


## Environment Configuration 💡

This project relies on several environment variables for connecting to services (database, authentication, etc.) and configuring the exam solver. To get started, create a file named `.env.local` in the root of the repository and fill in the values as shown below.

```env
# env.example - copy to .env.local and modify values
# ------------------------------------------------------------------
# Database connection (PostgreSQL/SQLite/etc.)
DATABASE_URL="postgresql://user:password@localhost:5432/exams?schema=public"

# NextAuth configuration
NEXTAUTH_SECRET="a-very-secret-string"
NEXTAUTH_URL="http://localhost:3000"

# Solver configuration (if applicable)
SOLVER_API_URL="http://localhost:8080"        # URL of the backend solver service
SOLVER_API_KEY="your-solver-api-key"

# Any additional variables used throughout the application
# e.g. feature flags, external service credentials, etc.
# ------------------------------------------------------------------
```

> **Tip:** You can commit `env.example` to version control but never commit `.env.local` since it may contain sensitive information.

### Running with the Environment

After creating `.env.local`, install dependencies and start the development server as described above. The app will automatically load environment variables from `.env.local`.

```bash
npm install   # or yarn / pnpm
npm run dev
```

This project relies on several environment variables for connecting to services (database, authentication, etc.) and configuring the exam solver. To get started, create a file named `.env.local` in the root of the repository and fill in the values as shown below.

```env
# env.example - copy to .env.local and modify values
# ------------------------------------------------------------------
# Database connection (PostgreSQL/SQLite/etc.)
DATABASE_URL="postgresql://user:password@localhost:5432/exams?schema=public"

# NextAuth configuration
NEXTAUTH_SECRET="a-very-secret-string"
NEXTAUTH_URL="http://localhost:3000"

# Solver configuration (if applicable)
SOLVER_API_URL="http://localhost:8080"        # URL of the backend solver service
SOLVER_API_KEY="your-solver-api-key"

# Any additional variables used throughout the application
# e.g. feature flags, external service credentials, etc.
# ------------------------------------------------------------------
```

> **Tip:** You can commit `env.example` to version control but never commit `.env.local` since it may contain sensitive information.

### Running with the Environment

After creating `.env.local`, install dependencies and start the development server as described above. The app will automatically load environment variables from `.env.local`.

```bash
npm install   # or yarn / pnpm
npm run dev
```


## Acknowledgements 🙏

This scheduling/solver functionality is built upon the **UniTime** exam scheduling engine. UniTime is an open-source project for university timetabling that provides a powerful solver and modelling framework. Many of the algorithms and ideas implemented here draw inspiration from that work.

For more information about UniTime, visit the [UniTime website](https://www.unitime.org/) or check out the [GitHub repository](https://github.com/unitime/unitime).

---

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
