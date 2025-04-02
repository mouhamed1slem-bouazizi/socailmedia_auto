import type { Meta, StoryObj } from '@storybook/react';
import { Card } from '@/components/ui/core/Card';

const meta: Meta<typeof Card> = {
  title: 'Core/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: 'This is a basic card',
  },
};

export const WithHeaderAndFooter: Story = {
  args: {
    header: 'Card Header',
    children: 'Card content goes here',
    footer: 'Card Footer',
  },
};