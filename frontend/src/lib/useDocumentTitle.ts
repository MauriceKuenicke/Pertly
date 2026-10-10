import { useEffect } from "react";

/** Sets the browser tab title (what the desktop window title bar used to show). */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
