import { ComposerForm } from "@/components/composer-form";
import { PageHeader } from "@/components/page-header";
import { getDraftCardContext } from "@/lib/draft-card-context";

export const metadata = { title: "New post · GMB Digital" };

export default async function NewPostPage() {
  return (
    <>
      <PageHeader
        title="New post"
        description="For stories that come in by Messenger or anywhere else outside the newsletters."
      />
      <ComposerForm context={await getDraftCardContext()} />
    </>
  );
}
