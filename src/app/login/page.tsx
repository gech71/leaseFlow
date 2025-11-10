
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  KeyRound,
  Phone,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import Image from "next/image";


export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This will handle generic errors passed by NextAuth redirect, if any
    const authError = searchParams.get("error");
    if (authError && !error) { // only set if no specific error is already displayed
        setError("An unexpected authentication error occurred.");
    }
  }, [searchParams, error]);


  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        phone,
        password,
        redirect: false, // Set redirect to false to handle the response here
      });

      if (result?.error) {
        // The error from the provider will be in result.error
        setError(result.error);
        setIsLoading(false);
      } else if (result?.ok) {
        // On successful sign-in, manually redirect
        router.push("/admin/dashboard");
        router.refresh();
      } else {
         setError("An unknown error occurred. Please try again.");
         setIsLoading(false);
      }
    } catch (e: any) {
        // This catch block handles network errors or other unexpected issues
        console.error("Login submission error:", e);
        setError("A network error occurred. Please check your connection.");
        setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-sm shadow-2xl animate-fadeIn">
        <CardHeader className="text-center">
          <Image
            src="/images/Nibtera.png"
            alt="LeaseFlow Logo"
            width={250}
            height={100}
            className="mx-auto"
            priority
          />
          <CardTitle className="mt-4 font-headline text-2xl">
            Building Management Solution
          </CardTitle>
          <CardDescription>
            Enter your credentials to access your portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded-md flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="phone" className="flex items-center">
                <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Phone Number"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="flex items-center">
                <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log In
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
