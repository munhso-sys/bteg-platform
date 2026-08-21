import { revalidatePath } from "next/cache";

export function revalidateActionsPaths() {
  revalidatePath("/actions");
  revalidatePath("/actions/open");
  revalidatePath("/actions/resolved");
}
