import type { RailInfo } from './railInfo';

export function RailHoverInfo(props: { info: RailInfo }) {
  return (
    <div className="rail-hover-panel" role="presentation" aria-hidden="true">
      <span className="rail-hover-panel__eyebrow">{props.info.eyebrow}</span>
      <h3 className="rail-hover-panel__title">{props.info.title}</h3>
      <p className="rail-hover-panel__description">{props.info.description}</p>

      <ul className="rail-hover-panel__bullets">
        {props.info.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>

      <div
        className={`rail-hover-panel__grid ${
          props.info.previews.length > 4 ? 'rail-hover-panel__grid--double' : 'rail-hover-panel__grid--single'
        }`}
      >
        {props.info.previews.map((preview) => (
          <figure className="rail-hover-panel__card" key={`${props.info.shortLabel}-${preview.caption}`}>
            <div className="rail-hover-panel__image">
              <img alt={preview.caption} src={preview.imageUrl} />
            </div>
            <figcaption className="rail-hover-panel__caption">{preview.caption}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
