import KeyTube from "./keytube-v2";
import { getAppUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getAppUser();
  return (
    <KeyTube
      user={
        user ? { id: user.userId, name: user.fullName || "Mi estudio" } : null
      }
      signInUrl="/?login=1"
    />
  );
}
