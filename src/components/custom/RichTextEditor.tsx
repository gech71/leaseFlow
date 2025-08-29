
"use client";

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import './quill-custom.css';
import { Skeleton } from '@/components/ui/skeleton';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const formats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'list', 'bullet', 'indent',
  'link', 'color', 'background'
];

const modules = {
  toolbar: [
    [{ 'header': '1'}, {'header': '2'}, { 'font': [] }],
    [{size: []}],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
    ['link'],
    ['clean']
  ],
};


export function RichTextEditor({ value, onChange, readOnly = false }: RichTextEditorProps) {
  // Use dynamic import for ReactQuill to ensure it only loads on the client side.
  const ReactQuill = useMemo(() => dynamic(() => import('react-quill'), { 
    ssr: false,
    loading: () => <Skeleton className="h-[200px] w-full rounded-md" />,
  }), []);

  return (
    <div className="bg-background rounded-md border border-input">
        <ReactQuill 
          theme="snow" 
          value={value} 
          onChange={onChange}
          readOnly={readOnly}
          modules={modules}
          formats={formats}
          className="rich-text-editor"
        />
    </div>
  );
}
