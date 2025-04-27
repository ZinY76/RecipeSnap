import { RecipeSnap } from "@/components/recipe-snap";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-24 bg-background">
      <div className="w-full max-w-4xl">
        <RecipeSnap />
      </div>
    </main>
  );
}
