import { Link } from 'react-router-dom';
import { V8_PRODUCTS_PATH, registrationHref } from '../../../marketing/landing-v8/public-config';

export function RegistrationCta({ className, onClick }: { className: string; onClick?: () => void }) {
  return (
    <a className={className} href={registrationHref()} onClick={onClick}>
      Registrierung
    </a>
  );
}

export function ProductsCta({ className }: { className: string }) {
  return (
    <Link className={className} to={V8_PRODUCTS_PATH}>
      Produkte ansehen
    </Link>
  );
}
