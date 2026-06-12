'use client';

import { useState, useRef } from 'react';
import type { IngredientChip } from '@/types/index';

interface IngredientChipsProps {
  chips: IngredientChip[];
  onChange: (chips: IngredientChip[]) => void;
}

export default function IngredientChips({ chips, onChange }: IngredientChipsProps) {
  const [addingNew, setAddingNew] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function removeChip(index: number) {
    onChange(chips.filter((_, i) => i !== index));
  }

  function commitAdd() {
    const name = inputValue.trim();
    if (!name) {
      setAddingNew(false);
      return;
    }
    onChange([...chips, { name, confidence: 1.0, user_added: true, removed: false }]);
    setInputValue('');
    setAddingNew(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitAdd();
    if (e.key === 'Escape') {
      setInputValue('');
      setAddingNew(false);
    }
  }

  const hasUnconfirmed = chips.some((c) => c.confidence < 0.8 && !c.user_added);

  return (
    <div>
      {/* Chip list */}
      <div className="flex flex-wrap gap-2">
        {chips.length === 0 && !addingNew && (
          <p className="w-full py-4 text-center text-[13px] text-[#806244]">
            Koi ingredient nahi! &apos;+ Aur add karo&apos; se daalo 🥕
          </p>
        )}

        {chips.map((chip, i) => {
          const confirmed = chip.confidence >= 0.8 || chip.user_added;
          return (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium"
              style={
                confirmed
                  ? { background: '#FDE8D8', color: '#BF4E06' }
                  : { background: '#F3F0FF', color: '#6B46C1' }
              }
            >
              {confirmed ? '' : '❓ '}
              {chip.name}
              <button
                type="button"
                onClick={() => removeChip(i)}
                className="ml-0.5 -my-1 flex h-7 w-7 items-center justify-center rounded-full text-[14px] opacity-70 hover:opacity-100"
                aria-label={`${chip.name} hatao`}
              >
                ✕
              </button>
            </span>
          );
        })}

        {/* Inline add input */}
        {addingNew && (
          <div className="flex items-center gap-1 rounded-full border border-[#E8640C] bg-white px-3 py-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ingredient likho..."
              className="w-28 bg-transparent text-[13px] text-[#1A1A1A] outline-none placeholder:text-[#806244]"
              autoFocus
            />
            <button
              type="button"
              onClick={commitAdd}
              className="text-[13px] text-[#BF4E06] font-bold"
              aria-label="Add karein"
            >
              ✓
            </button>
          </div>
        )}
      </div>

      {/* Add button */}
      {!addingNew && (
        <button
          type="button"
          onClick={() => {
            setAddingNew(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="mt-3 flex h-12 items-center gap-1.5 rounded-full border border-dashed border-[#BF4E06] px-4 text-[13px] font-medium text-[#BF4E06]"
        >
          + Aur add karo
        </button>
      )}

      {/* Unconfirmed hint */}
      {hasUnconfirmed && (
        <p className="mt-3 text-[12px] text-[#806244]">
          ❓ wale items check karein — hum sure nahi hain
        </p>
      )}
    </div>
  );
}
