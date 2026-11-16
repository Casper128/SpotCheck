import { ArrowUpRight } from "lucide-react";
import type { FormEvent, RefObject } from "react";

export function GuestReviewerModal({
  name,
  inputRef,
  onNameChange,
  onSubmit,
}: {
  readonly name: string;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onNameChange: (name: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop">
      <form className="guest-modal" onSubmit={onSubmit}>
        <div className="guest-modal-mark"><span className="brand-mark"><span /></span><span>spotcheck<span className="brand-period">.</span></span></div>
        <span className="guest-kicker">TE HAN INVITADO A REVISAR</span>
        <h1>Antes de empezar,<br /><em>¿cómo te llamas?</em></h1>
        <p>Tu nombre aparecerá junto a tus comentarios. No hace falta crear una cuenta.</p>
        <label className="field-label" htmlFor="guest-name">Tu nombre</label>
        <input ref={inputRef} className="text-field guest-name-input" id="guest-name" required minLength={1} maxLength={80} autoComplete="name" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="p. ej. Taylor" />
        <button className="button-primary guest-submit" type="submit">Entrar a la revisión <ArrowUpRight size={15} /></button>
        <span className="guest-note">Tu sesión se guarda solo en este dispositivo.</span>
      </form>
    </div>
  );
}
