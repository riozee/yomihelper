import React, { useState, useEffect, useRef, useCallback } from "react";

interface KeyboardInputProps {
  onTextChange?: (text: string) => void;
  value?: string;
  defaultValue?: string;
  className?: string;
}

const KeyboardInput: React.FC<KeyboardInputProps> = ({
  onTextChange,
  value,
  defaultValue = "",
  className = "",
}) => {
  const [text, setText] = useState<string>(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;

  const updateText = useCallback(
    (newText: string) => {
      if (!isControlled) setText(newText);
      onTextChange?.(newText);
    },
    [isControlled, onTextChange]
  );

  // Global key listener: if user types anywhere and the input isn't focused, focus it.
  // Do NOT prevent defaults; this preserves IME/Japanese input behavior.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!inputRef.current) return;

      const isPrintable = event.key.length === 1;
      const isBackspace = event.key === "Backspace";
      const hasModifier = event.altKey || event.ctrlKey || event.metaKey;
      const targetIsInput = document.activeElement === inputRef.current;

      if ((isPrintable || isBackspace) && !hasModifier && !targetIsInput) {
        // Just move focus to the input so the next keystrokes go there.
        inputRef.current.focus();
        // Do not modify text or prevent default to keep IME intact.
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const styles: React.CSSProperties = {
    height: "50px",
    padding: "10px 0",
    fontSize: "20px",
    color: "#ff79c6",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "1px solid #ff79c6",
    outline: "none",
    cursor: "text",
    minWidth: "250px",
    fontFamily: '"Fira Code", "Consolas", "Monaco", "Courier New", monospace',
  };

  const clear = () => updateText("");

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        style={{ ...styles, flex: 1 }}
        value={isControlled ? value ?? "" : text}
        onChange={(e) => updateText(e.target.value)}
        // IME support: let the browser handle composition; onChange will fire appropriately
        onCompositionStart={() => {
          /* intentionally no-op */
        }}
        onCompositionEnd={(e) =>
          updateText((e.target as HTMLInputElement).value)
        }
        aria-label="Keyboard input"
      />
      <button
        type="button"
        onClick={clear}
        title="Clear"
        aria-label="Clear input"
        style={{
          height: 32,
          minWidth: 64,
          padding: "0 10px",
          borderRadius: 6,
          border: "1px solid #4e4893",
          background: "#2a2652",
          color: "#ff79c6",
          cursor: "pointer",
        }}
      >
        Clear
      </button>
    </div>
  );
};

export default KeyboardInput;
