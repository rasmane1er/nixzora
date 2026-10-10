import { classifyHelpLocally } from './help-intent';

const orders = [
  { number: 'NX-AAAAAA', status: 'SHIPPED', items: ['Desk lamp'] },
  { number: 'NX-BBBBBB', status: 'PAID', items: ['Kettle'] },
];
const read = (...turns: string[]) => classifyHelpLocally(turns, orders);

describe('classifyHelpLocally', () => {
  it.each([
    ['Where is my package?', 'TRACK'],
    ['when will my order arrive', 'TRACK'],
    ['Où est mon colis ?', 'TRACK'],
    ['¿Dónde está mi paquete?', 'TRACK'],
    ['Please cancel my order', 'CANCEL'],
    ['Je veux annuler ma commande', 'CANCEL'],
    ['quiero cancelar el pedido', 'CANCEL'],
    ['I want to return these shoes, wrong size', 'RETURN'],
    ['Le produit est arrivé abîmé, je veux un échange', 'RETURN'],
    ['quiero devolver esto', 'RETURN'],
    ['where is my refund?', 'REFUND'],
    ['Où en est mon remboursement ?', 'REFUND'],
    ['Can I talk to a real person', 'HUMAN'],
    ['je voudrais parler à un conseiller', 'HUMAN'],
    ['quiero hablar con una persona', 'HUMAN'],
    ['show my orders', 'ORDERS'],
    ['thanks!', 'GREETING'],
    ['what is the meaning of life', 'OTHER'],
  ])('%s → %s', (text, intent) => {
    expect(read(text).intent).toBe(intent);
  });

  it('does not read words inside other words', () => {
    // "late" in "chocolate", "ship" in "relationship", "agent" in "reagents".
    expect(read('chocolate relationship reagents').intent).toBe('OTHER');
  });

  it('keeps only order numbers that are the shopper’s own', () => {
    expect(read('cancel nx-bbbbbb please')).toEqual({ intent: 'CANCEL', orderNumber: 'NX-BBBBBB' });
    expect(read('cancel NX-ZZZZZZ')).toEqual({ intent: 'CANCEL', orderNumber: null });
  });

  it('a bare order number continues the previous topic', () => {
    expect(read('I need to return something', 'NX-AAAAAA')).toEqual({
      intent: 'RETURN',
      orderNumber: 'NX-AAAAAA',
    });
    expect(read('NX-AAAAAA').intent).toBe('ORDERS');
  });
});
