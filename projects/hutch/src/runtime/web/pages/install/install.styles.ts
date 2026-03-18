export const INSTALL_PAGE_STYLES = `
.install-page {
  padding: 80px 20px;
}

.install-page__container {
  max-width: 720px;
  margin: 0 auto;
}

.install-page__title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--foreground);
}

.install-page__subtitle {
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--muted-foreground);
  margin-bottom: 40px;
}

.install-page__download {
  display: inline-block;
  padding: 16px 28px;
  border-radius: var(--radius);
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
  cursor: pointer;
  background: var(--primary);
  color: var(--primary-foreground);
  transition: opacity 0.2s;
  margin-bottom: 48px;
}

.install-page__download:hover {
  opacity: 0.9;
}

.install-page__steps {
  margin-bottom: 32px;
}

.install-page__steps h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--foreground);
}

.install-page__steps ol {
  padding-left: 20px;
}

.install-page__steps li {
  font-size: 1rem;
  line-height: 1.7;
  color: var(--muted-foreground);
  margin-bottom: 8px;
}

.install-page__steps code {
  background: var(--muted);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.875rem;
}

.install-page__footnote {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--muted-foreground);
  margin-top: 16px;
}
`;
