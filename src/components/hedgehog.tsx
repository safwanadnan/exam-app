import Image from "next/image";

export default function Hedgehog({ className }: { className?: string }) {
  return <Image src="/hedgehog.svg" alt="hedgehog" width={80} height={80} className={className} />;
}
