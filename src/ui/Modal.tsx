import type { ReactNode } from 'react';

/** daisyUI modal, always open while rendered. */
export function Modal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-box">
        <h2 className="text-lg font-bold mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="modal-action">{children}</div>;
}
