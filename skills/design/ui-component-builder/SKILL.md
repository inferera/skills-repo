# UI Component Builder

Build beautiful, accessible UI components with AI assistance across multiple frameworks.

## Supported Frameworks

- ⚛️ **React** - Components with hooks and TypeScript
- 💚 **Vue 3** - Composition API and script setup
- 🔥 **Svelte** - Reactive components with minimal boilerplate

## Features

### Component Generation
- Create components from descriptions
- Follow framework best practices
- Include accessibility features
- Generate TypeScript types

### Styling Options
- Tailwind CSS
- CSS Modules
- Styled Components
- Plain CSS

### Built-in Patterns
- Form components with validation
- Data tables with sorting/filtering
- Modal dialogs and overlays
- Navigation components
- Card layouts

## Quick Start

```bash
# Install dependencies
npm install

# Use with your agent
# The agent will automatically detect your framework
```

## Examples

### Creating a Button Component

```typescript
// React + Tailwind example
import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  const baseClasses = 'rounded font-medium transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };
  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

## Best Practices

1. **Accessibility First** - All components include ARIA attributes
2. **TypeScript** - Full type safety for better DX
3. **Responsive** - Mobile-first design approach
4. **Performance** - Optimized bundle size and render performance
5. **Testing** - Includes example tests for components

## Configuration

Create a `ui-builder.config.js` in your project:

```javascript
export default {
  framework: 'react', // or 'vue', 'svelte'
  styling: 'tailwind', // or 'css-modules', 'styled-components'
  typescript: true,
  accessibility: true
};
```

## Advanced Usage

### Custom Theme

```javascript
// Define your design system
const theme = {
  colors: {
    primary: '#3B82F6',
    secondary: '#6B7280',
    danger: '#EF4444'
  },
  spacing: {
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem'
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem'
  }
};
```

### Component Variants

Generate multiple variants of the same component with different styles and behaviors.

## Requirements

- Node.js 18+
- Framework of choice (React 18+, Vue 3+, or Svelte 4+)
- Basic understanding of component architecture

## Tips

- Start with simple components and gradually increase complexity
- Use the provided examples as templates
- Customize the generated code to match your design system
- Test components in isolation using Storybook

## Contributing

Contributions welcome! Please check the repository for guidelines.

## License

Apache-2.0 - See LICENSE file for details.
