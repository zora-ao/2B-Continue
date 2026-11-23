import { useState } from "react";
import { api } from "@/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DeleteHouseholdDialog({ household, opener, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteHousehold(household.id);
      onDeleted(household.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <AlertDialogContent onCloseAutoFocus={(event) => {
        event.preventDefault();
        const target = opener.current?.isConnected ? opener.current : document.getElementById("main");
        target?.focus();
      }}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {household.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the household, its appliances, readings, and saved plans.
            Housemates will lose access.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={confirm}>
            {busy ? "Deleting…" : "Delete household"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
