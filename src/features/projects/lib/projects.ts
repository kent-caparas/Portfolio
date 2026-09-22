import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;

const isVisible = (project: Project): boolean =>
  import.meta.env.PROD ? !project.data.draft : true;

const STATUS_LABELS: Record<Project['data']['status'], string> = {
  live: 'live',
  broken: 'broken',
  wip: 'wip',
  archived: 'archived',
};

/** All visible projects, ordered by `order` then name. Drafts are hidden in production builds. */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', isVisible);
  return projects.sort((a, b) => {
    if (a.data.order !== b.data.order) return a.data.order - b.data.order;
    return a.data.name.localeCompare(b.data.name);
  });
}

/** Featured projects only, for the home page. */
export async function getFeaturedProjects(): Promise<Project[]> {
  return (await getProjects()).filter((p) => p.data.featured);
}

/** Display label for a project status. */
export function statusLabel(status: Project['data']['status']): string {
  return STATUS_LABELS[status];
}

/** Shared name so the row title morphs into the page heading. */
export function projectTransitionName(project: Project): string {
  return `project-${project.id.replace(/[^a-z0-9-]/gi, '-')}`;
}
