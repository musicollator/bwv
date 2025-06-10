/**
 * Musical Notation Highlighter
 * ES6 Module for drawing smooth bezier curves around SVG noteheads
 * Perfect for highlighting fugue subjects and musical passages
 */

export default class MusicalHighlighter {
  constructor(svgContainer = null) {
    this.svgContainer = svgContainer;
    this.highlights = new Map(); // Track created highlights by ID
    this.defaultOptions = {
      color: '#ff6b6b',
      strokeWidth: 2,
      opacity: 0.7,
      padding: 8,
      className: 'notehead-highlight',
      smoothness: 0.3, // Controls how curved the path is (0-1)
      id: null // Optional unique identifier
    };
  }

  /**
   * Main method to highlight noteheads matching a selector
   * @param {string} selector - CSS selector for noteheads
   * @param {Object} options - Styling and behavior options
   * @returns {SVGPathElement|null} The created highlight path
   */
  highlight(selector, options = {}) {
    const opts = { ...this.defaultOptions, ...options };
    
    // Get all noteheads matching the selector
    const noteheads = document.querySelectorAll(selector);
    
    if (noteheads.length === 0) {
      console.warn(`No noteheads found for selector: ${selector}`);
      return null;
    }
    
    // Find SVG container
    const svgContainer = this.svgContainer || noteheads[0].closest('svg');
    if (!svgContainer) {
      console.error('Could not find SVG container');
      return null;
    }
    
    // Calculate points and create path
    const points = this.#extractNoteheadPoints(noteheads, svgContainer);
    const envelope = this.#calculateEnvelope(points, opts.padding);
    const pathData = this.#createSmoothPath(envelope, opts.smoothness);
    
    // Create and style the highlight path
    const path = this.#createHighlightPath(pathData, opts);
    
    // Insert into SVG
    svgContainer.insertBefore(path, noteheads[0]);
    
    // Track the highlight if it has an ID
    if (opts.id) {
      this.highlights.set(opts.id, path);
    }
    
    return path;
  }

  /**
   * Highlight multiple subjects with different colors
   * @param {Array} subjects - Array of {selector, options} objects
   * @returns {Array} Array of created highlight paths
   */
  highlightMultiple(subjects) {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#fd79a8', '#fdcb6e'];
    const highlights = [];
    
    subjects.forEach((subject, index) => {
      const options = {
        color: colors[index % colors.length],
        className: `fugue-subject-${index + 1}`,
        id: `subject-${index + 1}`,
        ...subject.options
      };
      
      const highlight = this.highlight(subject.selector, options);
      if (highlight) {
        highlights.push(highlight);
      }
    });
    
    return highlights;
  }

  /**
   * Remove a specific highlight by ID
   * @param {string} id - The ID of the highlight to remove
   */
  removeHighlight(id) {
    const highlight = this.highlights.get(id);
    if (highlight && highlight.parentNode) {
      highlight.parentNode.removeChild(highlight);
      this.highlights.delete(id);
    }
  }

  /**
   * Remove all highlights created by this instance
   */
  removeAllHighlights() {
    this.highlights.forEach((highlight, id) => {
      if (highlight.parentNode) {
        highlight.parentNode.removeChild(highlight);
      }
    });
    this.highlights.clear();
    
    // Also remove any highlights with default class name
    document.querySelectorAll('.notehead-highlight').forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  /**
   * Get a highlight by ID
   * @param {string} id - The ID of the highlight
   * @returns {SVGPathElement|undefined}
   */
  getHighlight(id) {
    return this.highlights.get(id);
  }

  /**
   * Update the style of an existing highlight
   * @param {string} id - The ID of the highlight
   * @param {Object} styles - CSS properties to update
   */
  updateHighlightStyle(id, styles) {
    const highlight = this.highlights.get(id);
    if (highlight) {
      Object.keys(styles).forEach(property => {
        highlight.style[property] = styles[property];
      });
    }
  }

  // Private methods using # syntax

  #extractNoteheadPoints(noteheads, svgContainer) {
    return Array.from(noteheads).map(notehead => {
      const bbox = notehead.getBBox();
      const transform = notehead.getCTM() || svgContainer.createSVGMatrix();
      
      return {
        x: transform.e + bbox.x + bbox.width / 2,
        y: transform.f + bbox.y + bbox.height / 2,
        width: bbox.width,
        height: bbox.height,
        element: notehead
      };
    }).sort((a, b) => a.x - b.x); // Sort by x-coordinate
  }

  #calculateEnvelope(points, padding) {
    if (points.length === 0) return [];
    
    const minX = Math.min(...points.map(p => p.x - p.width/2)) - padding;
    const maxX = Math.max(...points.map(p => p.x + p.width/2)) + padding;
    const minY = Math.min(...points.map(p => p.y - p.height/2)) - padding;
    const maxY = Math.max(...points.map(p => p.y + p.height/2)) + padding;
    
    const topPoints = [];
    const bottomPoints = [];
    
    // Create adaptive segments based on point distribution
    const segments = Math.max(4, Math.min(points.length, 12));
    const segmentWidth = (maxX - minX) / segments;
    
    for (let i = 0; i <= segments; i++) {
      const x = minX + i * segmentWidth;
      
      const nearbyPoints = points.filter(p => 
        Math.abs(p.x - x) <= segmentWidth * 0.6
      );
      
      if (nearbyPoints.length > 0) {
        const topY = Math.min(...nearbyPoints.map(p => p.y - p.height/2)) - padding;
        const bottomY = Math.max(...nearbyPoints.map(p => p.y + p.height/2)) + padding;
        
        topPoints.push({ x, y: topY });
        bottomPoints.push({ x, y: bottomY });
      } else {
        const topY = this.#interpolateY(topPoints, x) || minY;
        const bottomY = this.#interpolateY(bottomPoints, x) || maxY;
        
        topPoints.push({ x, y: topY });
        bottomPoints.push({ x, y: bottomY });
      }
    }
    
    return [...topPoints, ...bottomPoints.reverse()];
  }

  #interpolateY(points, x) {
    if (points.length === 0) return null;
    if (points.length === 1) return points[0].y;
    
    let left = points[0];
    let right = points[points.length - 1];
    
    for (let i = 0; i < points.length - 1; i++) {
      if (points[i].x <= x && points[i + 1].x >= x) {
        left = points[i];
        right = points[i + 1];
        break;
      }
    }
    
    if (left.x === right.x) return left.y;
    
    const ratio = (x - left.x) / (right.x - left.x);
    return left.y + ratio * (right.y - left.y);
  }

  #createSmoothPath(points, smoothness) {
    if (points.length < 3) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const current = points[i];
      const previous = points[i - 1];
      const next = points[(i + 1) % points.length];
      
      const cp1x = previous.x + (current.x - previous.x) * smoothness;
      const cp1y = previous.y + (current.y - previous.y) * smoothness;
      
      const cp2x = current.x - (next.x - previous.x) * smoothness * 0.5;
      const cp2y = current.y - (next.y - previous.y) * smoothness * 0.5;
      
      if (i === 1) {
        path += ` Q ${cp2x} ${cp2y} ${current.x} ${current.y}`;
      } else {
        path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${current.x} ${current.y}`;
      }
    }
    
    path += ' Z';
    return path;
  }

  #createHighlightPath(pathData, options) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', options.color);
    path.setAttribute('stroke-width', options.strokeWidth);
    path.setAttribute('opacity', options.opacity);
    path.setAttribute('class', options.className);
    
    if (options.id) {
      path.setAttribute('data-highlight-id', options.id);
    }
    
    return path;
  }
}

// Convenience function for quick highlighting without instantiating a class
export function quickHighlight(selector, options = {}) {
  const highlighter = new MusicalHighlighter();
  return highlighter.highlight(selector, options);
}

// Example usage and common patterns
export const FuguePresets = {
  subject: { color: '#ff6b6b', strokeWidth: 2.5, padding: 10 },
  answer: { color: '#4ecdc4', strokeWidth: 2.5, padding: 10 },
  countersubject: { color: '#45b7d1', strokeWidth: 2, padding: 8 },
  episode: { color: '#96ceb4', strokeWidth: 1.5, padding: 6, opacity: 0.5 }
};

/*
Example usage:

import MusicalHighlighter, { quickHighlight, FuguePresets } from './musical-highlighter.js';

// Method 1: Using the class
const highlighter = new MusicalHighlighter();

// Highlight BWV 846 fugue subjects
highlighter.highlightMultiple([
  { selector: '.alto-subject-m1', options: { ...FuguePresets.subject, id: 'alto-subject' } },
  { selector: '.soprano-answer-m2', options: { ...FuguePresets.answer, id: 'soprano-answer' } },
  { selector: '.tenor-subject-m4', options: { ...FuguePresets.subject, id: 'tenor-subject' } },
  { selector: '.bass-answer-m5', options: { ...FuguePresets.answer, id: 'bass-answer' } }
]);

// Update a specific highlight
highlighter.updateHighlightStyle('alto-subject', { stroke: '#ff0000', strokeWidth: '3' });

// Remove specific highlight
highlighter.removeHighlight('soprano-answer');

// Method 2: Quick highlighting
quickHighlight('.noteheads.subject', { color: '#ff6b6b', padding: 12 });
*/