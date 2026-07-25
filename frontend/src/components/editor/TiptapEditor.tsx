"use client";

import { Button, Tooltip } from "antd";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Redo2, Undo2 } from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TiptapEditor({ value, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[260px] rounded-b-lg border-x border-b border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value || "", false);
  }, [editor, value]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter link URL", previousUrl ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div className="rounded-lg">
      <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-slate-200 bg-slate-50 p-2">
        <Tooltip title="Bold">
          <Button
            size="small"
            type={editor.isActive("bold") ? "primary" : "text"}
            icon={<Bold size={14} />}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
        </Tooltip>
        <Tooltip title="Italic">
          <Button
            size="small"
            type={editor.isActive("italic") ? "primary" : "text"}
            icon={<Italic size={14} />}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
        </Tooltip>
        <Tooltip title="Bullet list">
          <Button
            size="small"
            type={editor.isActive("bulletList") ? "primary" : "text"}
            icon={<List size={14} />}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
        </Tooltip>
        <Tooltip title="Numbered list">
          <Button
            size="small"
            type={editor.isActive("orderedList") ? "primary" : "text"}
            icon={<ListOrdered size={14} />}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
        </Tooltip>
        <Tooltip title="Link">
          <Button
            size="small"
            type={editor.isActive("link") ? "primary" : "text"}
            icon={<LinkIcon size={14} />}
            onClick={setLink}
          />
        </Tooltip>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <Tooltip title="Undo">
          <Button
            size="small"
            type="text"
            icon={<Undo2 size={14} />}
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          />
        </Tooltip>
        <Tooltip title="Redo">
          <Button
            size="small"
            type="text"
            icon={<Redo2 size={14} />}
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </Tooltip>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
