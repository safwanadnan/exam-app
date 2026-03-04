import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SignupClient from "./signup-client";

export default async function SignupPage() {
    // Check if any users exist in the database
    const userCount = await prisma.user.count();

    // If users exist, nobody else can sign up. They must log in.
    if (userCount > 0) {
        redirect("/login");
    }

    // If no users exist, show the signup form
    return <SignupClient />;
}
