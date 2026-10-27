import { useEffect, useState, type ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Link, Route, Switch, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

function AccountQueries({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => { void client.cancelQueries(); client.clear(); }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function AccountRoutes({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  if (!isLoaded) return <div role="status" className="p-8 text-muted-foreground">Opening Podium…</div>;
  return (
    <AccountQueries key={userId ?? "guest"}>
      <Switch>
        <Route path="/sign-in/*?">
          <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
            <Link href="/" className="text-primary">Back to Podium</Link>
            <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
          </div>
        </Route>
        <Route path="/sign-up/*?">
          <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
            <Link href="/" className="text-primary">Back to Podium</Link>
            <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
          </div>
        </Route>
        <Route>{children}</Route>
      </Switch>
    </AccountQueries>
  );
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={basePath || "/"}
      signUpFallbackRedirectUrl={basePath || "/"}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      appearance={{
        theme: shadcn,
        cssLayerName: "clerk",
        options: { logoImageUrl: `${window.location.origin}${basePath}/logo.svg`, logoLinkUrl: basePath || "/", logoPlacement: "inside" },
        variables: {
          colorPrimary: "#8d1230", colorForeground: "#211c1a",
          colorMutedForeground: "#68615b", colorBackground: "#ffffff",
          colorInput: "#ffffff", colorInputForeground: "#211c1a",
          colorDanger: "#b91c1c", colorNeutral: "#211c1a",
          fontFamily: "Inter, sans-serif", borderRadius: "0.5rem",
        },
        elements: {
          rootBox: "w-full flex justify-center",
          cardBox: "bg-white rounded-xl w-[440px] max-w-full overflow-hidden",
          card: "!shadow-none !border-0 !bg-transparent !rounded-none",
          footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
          headerTitle: "text-foreground", headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButtonText: "text-foreground", formFieldLabel: "text-foreground",
          footerActionLink: "text-primary", footerActionText: "text-muted-foreground",
          dividerText: "text-muted-foreground",
        },
      }}
      localization={{
        signIn: { start: { title: "Welcome back to Podium", subtitle: "Sign in to save and resume your speaking progress." } },
        signUp: { start: { title: "Your Podium account", subtitle: "Keep your practice, assessments, and feedback across devices." } },
      }}
    >
      <AccountRoutes>{children}</AccountRoutes>
    </ClerkProvider>
  );
}
