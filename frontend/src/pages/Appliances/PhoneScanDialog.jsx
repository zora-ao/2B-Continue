import { useEffect, useRef, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/api";
import Spinner from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const POLL_MS = 2000;

export default function PhoneScanDialog({ open, onOpenChange, onResult }) {
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState("starting"); // starting | waiting | expired | error
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Keep the latest callbacks without restarting the session on every render.
  const callbacks = useRef({ onResult, onOpenChange });
  callbacks.current = { onResult, onOpenChange };
  // Held until the dialog has closed, so the form can move focus without Radix moving it back.
  const pendingResult = useRef(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let timer;
    setCode("");
    setPhase("starting");
    setError("");

    async function poll(sessionCode) {
      try {
        const session = await api.getScanSession(sessionCode, { signal: controller.signal });
        if (session.status === "done") {
          pendingResult.current = session.result;
          callbacks.current.onOpenChange(false);
        } else if (session.status === "expired") {
          setPhase("expired");
        } else {
          timer = setTimeout(() => poll(sessionCode), POLL_MS);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        setPhase("error");
        setError(err.message);
      }
    }

    api
      .startScanSession()
      .then((session) => {
        if (controller.signal.aborted) return;
        setCode(session.code);
        setPhase("waiting");
        timer = setTimeout(() => poll(session.code), POLL_MS);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setPhase("error");
        setError(err.message);
      });

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, attempt]);

  const link = code ? `${window.location.origin}/scan/${code}` : "";

  function handleCloseAutoFocus(event) {
    const result = pendingResult.current;
    if (!result) return;
    pendingResult.current = null;
    event.preventDefault();
    onResult(result);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage("Link copied");
    } catch {
      setCopyMessage("Couldn't copy the link");
    }
    setTimeout(() => setCopyMessage(""), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overscroll-contain sm:max-w-sm" onCloseAutoFocus={handleCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle className="font-heading">Scan with your phone</DialogTitle>
          <DialogDescription>
            Scan this code with your phone's camera, then take a photo of the appliance's rating label.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div className="flex size-56 items-center justify-center rounded-xl bg-white p-3">
            {phase === "waiting" ? (
              <QRCodeSVG value={link} size={200} title="QR code for the phone scan link" />
            ) : phase === "starting" ? (
              <Spinner label="Making a code" />
            ) : (
              <p className="text-center text-sm text-neutral-600">No code right now</p>
            )}
          </div>

          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground empty:hidden">
            {phase === "waiting" && (
              <>
                <Spinner label="Waiting for photo" />
                Waiting for the photo from your phone...
              </>
            )}
            {phase === "expired" && "This code expired."}
          </p>
          {phase === "error" && (
            <p role="alert" className="text-center text-sm text-danger">
              {error}
            </p>
          )}

          {phase === "waiting" && (
            <div className="flex w-full flex-col items-center gap-1">
              <Button type="button" variant="outline" onClick={copyLink}>
                <Copy />
                Copy link
              </Button>
              <span role="status" className="text-xs text-muted-foreground">
                {copyMessage}
              </span>
            </div>
          )}

          {(phase === "expired" || phase === "error") && (
            <Button type="button" onClick={() => setAttempt((count) => count + 1)}>
              <RefreshCw />
              New code
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
