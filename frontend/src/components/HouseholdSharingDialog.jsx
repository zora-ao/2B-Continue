import { useEffect, useState } from "react";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function HouseholdSharingDialog({ mode, household, onClose, onJoined, opener }) {
  const sharing = mode === "share";
  const [invite, setInvite] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invite) return;
    const updateRemaining = () => {
      setRemaining(Math.max(0, Math.ceil((invite.deadline - performance.now()) / 1000)));
    };
    updateRemaining();
    const timer = setInterval(updateRemaining, 250);
    return () => clearInterval(timer);
  }, [invite]);

  async function generate() {
    const startedAt = performance.now();
    setBusy(true);
    setError("");
    try {
      const result = await api.createHouseholdInvite(household.id);
      const deadline = startedAt + result.expires_in * 1000;
      setRemaining(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));
      setInvite({ pin: result.pin, deadline });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function join(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { item } = await api.joinHousehold(pin);
      onJoined(item);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent onCloseAutoFocus={(event) => {
        event.preventDefault();
        const target = opener.current?.isConnected ? opener.current : document.getElementById("main");
        target?.focus();
      }}>
        <DialogHeader>
          <DialogTitle>{sharing ? "Share household" : "Join a household"}</DialogTitle>
          <DialogDescription>
            {sharing
              ? `Give the PIN to one housemate so they can view and edit ${household.name}. Each PIN works once and expires in 60 seconds.`
              : "Enter the 8-digit PIN from the household owner."}
          </DialogDescription>
        </DialogHeader>

        {sharing ? (
          <div className="flex flex-col gap-4">
            {invite && (remaining > 0 ? (
              <div className="rounded-lg border p-4 text-center">
                <p aria-label={`Household PIN ${invite.pin}`} className="select-all font-mono text-3xl tracking-widest">
                  {invite.pin}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">Expires in {remaining}s</p>
              </div>
            ) : <p role="status">PIN expired. Generate a new one.</p>)}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <DialogFooter>
              <Button type="button" onClick={generate} disabled={busy}>
                {busy ? "Generating…" : invite ? "Generate new PIN" : "Generate PIN"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={join} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="household-invite-pin">Household PIN</Label>
              <Input id="household-invite-pin" value={pin} inputMode="numeric" autoComplete="off"
                pattern="[0-9]{8}" maxLength={8} required disabled={busy}
                onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, ""))} />
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={busy || pin.length !== 8}>
                {busy ? "Joining…" : "Join household"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
