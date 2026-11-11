# Working agreement

- Work on small tasks authorized in advance. Keep changes within the agreed scope.
- Develop, install dependencies, build and run tests exclusively through ephemeral Docker containers. Do not require Node.js, npm or Angular CLI on the host.
- Run `./bin/test` for automated tests and `./bin/check` before completing a task. The latter must pass reproducible lockfile installation, TypeScript checks, tests, production library build, npm package verification and the disposable Angular consumer build.
- Review the complete diff, including new files, and run `git diff --check` before committing.
- Make a local commit when each authorized task is complete and its required checks pass.
- Obtain separate explicit authorization for push, pull request creation, merge, npm publication and deployment. Local task authorization does not include those actions.
- Write public documentation and code documentation in English.
- Keep this shared library strictly separate from consumer applications. Do not add application-specific business logic, permanent demo applications or unapproved metadata contracts.
- A future `apps/testbed/` is authorized only as a repository-local, non-distributed Angular QA fixture for the UI Runtime 1.0 contract. It must consume the built APF package through public exports, run in ephemeral Docker through the validation workflow, and remain excluded from the npm package. This exception does not authorize an ERP, production/demo application or implementation in AUR-CONTRACT-001.
- Keep Angular packages as peer dependencies where required by the library. Use the official Angular Package Format tooling and the public entry point; consumers must not depend on repository source paths.
- Keep test consumers disposable and isolated. Never modify reference repositories as part of library validation.
- Do not remove containers, images or volumes belonging to other projects.
