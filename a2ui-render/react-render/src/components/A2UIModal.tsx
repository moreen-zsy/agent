/**
 * A2UI Modal 组件 (v0.9)
 * entryPointChild/contentChild → trigger/content
 */

import { useState, type ReactNode } from 'react';
import type { A2UIComponentProps } from './types.js';

export interface ModalProps extends A2UIComponentProps {
  trigger?: ReactNode;
  content?: ReactNode;
}

export function A2UIModal({ trigger, content }: ModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div onClick={() => setIsOpen(true)} className="cursor-pointer inline-block">
        {trigger}
      </div>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </div>
        </div>
      )}
    </>
  );
}
