import { useState } from "react";
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
import ApplianceForm from "./ApplianceForm.jsx";
import ApplianceList from "./ApplianceList.jsx";

// The Appliances page: a form on the left, the list on the right.
//
// For now the list lives only in this page's state (it resets on refresh).
// When the backend is ready, swap these state updates for API calls.
export default function AppliancesPage() {
  const [appliances, setAppliances] = useState([]);
  const [editing, setEditing] = useState(null); // appliance being edited
  const [deleting, setDeleting] = useState(null); // appliance waiting for "Delete?" confirm

  function handleSubmit(applianceData) {
    if (editing) {
      // Replace the edited appliance, keeping its id.
      setAppliances(
        appliances.map((appliance) =>
          appliance.id === editing.id ? { ...applianceData, id: editing.id } : appliance,
        ),
      );
      setEditing(null);
    } else {
      setAppliances([...appliances, { ...applianceData, id: crypto.randomUUID() }]);
    }
  }

  function confirmDelete() {
    setAppliances(appliances.filter((appliance) => appliance.id !== deleting.id));
    if (editing?.id === deleting.id) {
      setEditing(null);
    }
    setDeleting(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold">Appliances</h1>
        <p className="text-muted-foreground">
          Type in your appliances to see how much each one costs.
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full lg:w-[400px] lg:shrink-0">
          <ApplianceForm
            editing={editing}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        </div>

        <div className="min-w-0 flex-1">
          <ApplianceList
            appliances={appliances}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        </div>
      </div>

      {/* "Are you sure?" dialog for deleting */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from your appliance list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
