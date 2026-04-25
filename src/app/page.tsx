import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-background px-6 py-20">
      <main className="flex w-full max-w-3xl flex-1 flex-col items-center justify-between gap-10 sm:items-start">
        <div className="text-primary">
          <Image
            src="/brand/logo-wordmark.svg"
            alt="uwyoSchedules"
            width={200}
            height={40}
            priority
          />
        </div>
        <div className="flex w-full flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-prose text-balance font-serif text-3xl font-medium leading-10 tracking-tight text-foreground sm:text-4xl">
            From course list to class schedule, in minutes.
          </h1>
          <p className="text-muted-foreground max-w-prose text-pretty text-lg leading-relaxed">
            Pick your classes. This app is being built to find every working
            combination, without the back-and-forth of WyoWeb&rsquo;s
            registration flow. In the meantime, you can also explore{" "}
            <Link
              className="font-medium text-primary underline decoration-1 underline-offset-4"
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            >
              templates
            </Link>{" "}
            or the{" "}
            <Link
              className="font-medium text-primary underline decoration-1 underline-offset-4"
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            >
              Next.js course
            </Link>
            .
          </p>
        </div>
        <div className="flex w-full flex-col gap-4 text-base font-medium sm:flex-row">
          <Link
            className="bg-primary text-primary-foreground flex h-12 w-full items-center justify-center rounded-md px-5 transition-opacity duration-200 ease-out hover:opacity-90 md:max-w-40"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Deploy
          </Link>
          <Link
            className="text-foreground flex h-12 w-full items-center justify-center rounded-md border border-border px-5 transition-colors duration-200 ease-out hover:bg-muted md:max-w-40"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </Link>
        </div>
      </main>
    </div>
  );
}
