# Plataforma de Personalización de Sierra Muebles

## Descripción General del Proyecto

Esta plataforma permite a los clientes de Sierra Muebles personalizar muebles y decoración a través de una experiencia de realidad aumentada. Los usuarios pueden explorar modelos 3D de productos, aplicar diferentes acabados y texturas, y visualizar cómo se verían en sus espacios. Además, la plataforma ofrece la creación de plantillas personalizables con estos modelos 3D.

## Características Clave

- Integración de realidad aumentada para visualización de muebles y decoración
- Amplio catálogo de modelos 3D de productos de Sierra Muebles
- Herramientas de personalización para aplicar acabados, texturas y modificaciones
- Creación de plantillas personalizables con los modelos 3D
- Almacenamiento y gestión de diseños personalizados del cliente

## Despliegue con Docker

Para desplegar la plataforma de personalización de Sierra Muebles utilizando Docker, sigue estos pasos:

1. Construir la imagen de Docker:

   ```bash
   docker build -t sierramuebles .
   ```

2. Ejecutar el contenedor de Docker en segundo plano:

   ```bash
   docker run -d --name docker_sierramuebles -p 5000:5000 --restart always sierramuebles
   ```

Comandos útiles de Docker:

```bash
# Ver los registros del contenedor
docker logs docker_sierramuebles

# Detener el contenedor
docker stop docker_sierramuebles

# Reiniciar el contenedor
docker restart docker_sierramuebles

# Eliminar el contenedor
docker rm docker_sierramuebles
```

## Equipo de Desarrollo

- Gerente de Proyecto: [Nombre]
- Diseñador UX/UI: [Nombre]
- Desarrollador de Software: [Nombre]
- Especialista en RA/3D: [Nombre]
- Arquitecto de Nube: [Nombre]