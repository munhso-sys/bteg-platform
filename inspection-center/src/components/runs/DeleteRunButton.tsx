"use client";

import { Trash2 } from "lucide-react";

export function DeleteRunButton({
  runId,
  action,
}: {
  runId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={runId} />
      <button
        type="submit"
        className="btn p-2 text-red-700 hover:bg-red-50"
        aria-label="Устгах"
        title="Устгах"
        onClick={(event) => {
          if (
            !window.confirm(
              "Энэ шалгалтыг устгах уу? Холбогдох төлөвлөгөөний бүртгэл ч хасагдана.",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </button>
    </form>
  );
}
