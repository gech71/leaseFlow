"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createEditor, Descendant, Node } from "slate";
import { Slate, Editable, withReact } from "slate-react";
import { withHistory } from "slate-history";

type ParagraphElement = { type: "paragraph"; children: { text: string }[] };

const emptyValue: Descendant[] = [
  { type: "paragraph", children: [{ text: "" }] } satisfies ParagraphElement,
];

function htmlOrTextToPlainText(input: string): string {
  if (!input) return "";

  // Keep it simple and deterministic (no DOMParser dependency).
  // This makes existing HTML templates editable as plain text.
  const withNewlines = input
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|h\d)>/gi, "\n");

  const stripped = withNewlines.replace(/<[^>]+>/g, "");

  return stripped
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function plainTextToSlateValue(text: string): Descendant[] {
  const normalized = (text || "").replace(/\r\n/g, "\n");
  if (!normalized) return emptyValue;

  const lines = normalized.split("\n");
  return lines.map(
    (line) =>
      ({
        type: "paragraph",
        children: [{ text: line }],
      } satisfies ParagraphElement),
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slateValueToHtml(value: Descendant[]): string {
  // Serialize each top-level block as <p>...</p> so jsPDF's doc.html
  // and other HTML renderers preserve line breaks.
  return value
    .map((n) => {
      const text = Node.string(n);
      const safe = escapeHtml(text);
      return safe.length === 0 ? "<p><br/></p>" : `<p>${safe}</p>`;
    })
    .join("");
}

export function stripHtmlToTextLength(input: string): number {
  return htmlOrTextToPlainText(input).trim().length;
}

export function AgreementTemplateSlateEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
}) {
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const [internalValue, setInternalValue] = useState<Descendant[]>(() =>
    plainTextToSlateValue(htmlOrTextToPlainText(value)),
  );

  useEffect(() => {
    setInternalValue(plainTextToSlateValue(htmlOrTextToPlainText(value)));
    // Only when external string changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const renderElement = useCallback((props: any) => {
    const { attributes, children } = props;
    return <p {...attributes}>{children}</p>;
  }, []);

  return (
    <div className="rounded-md border bg-background p-3">
      <Slate
        editor={editor}
        initialValue={internalValue}
        onChange={(next: Descendant[]) => {
          setInternalValue(next);
          onChange(slateValueToHtml(next));
        }}
      >
        <Editable
          renderElement={renderElement}
          placeholder={placeholder}
          className="min-h-[300px] whitespace-pre-wrap focus:outline-none"
          spellCheck
        />
      </Slate>
    </div>
  );
}
