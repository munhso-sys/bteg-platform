import { revalidatePath } from "next/cache";

export function revalidateFindingsPaths() {
  revalidatePath("/findings");
  revalidatePath("/findings/state");
  revalidatePath("/findings/night");
  revalidatePath("/findings/joint");
}
