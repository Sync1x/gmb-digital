import { ComposerForm } from "@/components/composer-form";
import { getDraftCardContext } from "@/lib/draft-card-context";

export const metadata = { title: "New post · GMB Digital" };

export default function NewPostPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New post</h1>
        <p className="text-sm text-muted-foreground">
          For stories that come in by Messenger or anywhere else outside the newsletters.
        </p>
      </div>
      <ComposerForm context={getDraftCardContext()} />
    </>
  );
}
