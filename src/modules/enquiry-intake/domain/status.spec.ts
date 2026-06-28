import { canTransition, isTerminal, assertTransition } from './status';
import { BusinessRuleError } from '@common/errors/errors';

describe('enquiry status machine', () => {
  it('allows the documented forward transitions', () => {
    expect(canTransition('New', 'In Progress')).toBe(true);
    expect(canTransition('In Progress', 'Quoted')).toBe(true);
    expect(canTransition('Quoted', 'Won')).toBe(true);
    expect(canTransition('Quoted', 'Revision Requested')).toBe(true);
    expect(canTransition('Revision Requested', 'Quoted')).toBe(true);
    expect(canTransition('Expired', 'In Progress')).toBe(true); // reopen
  });

  it('forbids illegal transitions', () => {
    expect(canTransition('New', 'Won')).toBe(false);
    expect(canTransition('New', 'Quoted')).toBe(false);
    expect(canTransition('Won', 'In Progress')).toBe(false);
  });

  it('marks Won and Lost as terminal', () => {
    expect(isTerminal('Won')).toBe(true);
    expect(isTerminal('Lost')).toBe(true);
    expect(isTerminal('New')).toBe(false);
  });

  it('assertTransition throws on illegal and no-op moves', () => {
    expect(() => assertTransition('New', 'Won')).toThrow(BusinessRuleError);
    expect(() => assertTransition('New', 'New')).toThrow(/already in status/);
    expect(() => assertTransition('New', 'In Progress')).not.toThrow();
  });
});
