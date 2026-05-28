import React from "react";

export default function ProjectCard({ project, onClick }) {
  const isActive =
    project.is_active === 1 ||
    project.is_active === true ||
    project.status !== "completed";

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        w-full rounded-2xl p-4
        border border-slate-700
        bg-slate-900/70
        hover:bg-slate-800/80
        shadow-md
        text-left
        transition
      "
    >
      <div className="text-[11px] text-slate-400 uppercase tracking-wide">
        {project.customer || "Customer"}
      </div>

      <div className="text-lg font-semibold text-slate-50 mt-1">
        {project.code || project.name || project.project_code}
      </div>

      {project.location && (
        <div className="text-xs mt-1 text-slate-500">
          {project.location}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <span
          className={`
            inline-flex px-2 py-1 rounded-full text-[11px]
            ${
              isActive
                ? "bg-emerald-900/40 text-emerald-300"
                : "bg-slate-800 text-slate-400"
            }
          `}
        >
          {project.status || (isActive ? "active" : "completed")}
        </span>
      </div>
    </button>
  );
}
