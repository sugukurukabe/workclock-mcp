import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const TICKET_PATTERN = /([A-Z]{2,10}-\d+)/;

export interface GitContext {
  branch?: string;
  project?: string;
  ticket?: string;
}

/**
 * Reads the current git branch (read-only) and derives a project + ticket hint.
 *
 * feature/SG-123-auth-flow -> { ticket: "SG-123", project: "auth-flow" }
 * bugfix/login            -> { project: "login" }
 *
 * Never throws: returns an empty context if git is unavailable or the cwd is
 * not a repository.
 */
export async function detectGitContext(cwd: string): Promise<GitContext> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      timeout: 1500,
      windowsHide: true,
    });
    const branch = stdout.trim();
    if (!branch || branch === 'HEAD') {
      return {};
    }
    return { branch, ...parseBranch(branch) };
  } catch {
    return {};
  }
}

export function parseBranch(branch: string): { project?: string; ticket?: string } {
  const ticketMatch = branch.toUpperCase().match(TICKET_PATTERN);
  const ticket = ticketMatch?.[1];

  // Strip a leading category prefix (feature/, fix/, bugfix/, chore/, etc.).
  const withoutPrefix = branch.includes('/')
    ? branch.slice(branch.indexOf('/') + 1)
    : branch;

  // Project = remaining slug after removing the ticket id and surrounding separators.
  let project = withoutPrefix;
  if (ticket) {
    project = withoutPrefix.replace(new RegExp(ticket, 'i'), '');
  }
  project = project.replace(/[-_/]+/g, '-').replace(/^-|-$/g, '').trim();

  return {
    project: project ? project.slice(0, 80) : undefined,
    ticket: ticket ? ticket.slice(0, 60) : undefined,
  };
}
