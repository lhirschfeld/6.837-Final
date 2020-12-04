const planetVertexShader = `
varying vec3 local_position;
varying vec3 global_normal;
varying vec3 camera_direction;

void main()
{
    local_position = position; // vec3(0.5, 0.5, 0.5) + vec3(0.5, 0.5, 0.5);
    global_normal = normalize(normalMatrix * normal);
    camera_direction = normalize(cameraPosition - (modelViewMatrix * vec4( position, 1.0 )).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`

const planetFragmentShader = `
varying vec3 local_position; // Scaled between 0 and 1.
varying vec3 global_normal;
varying vec3 camera_direction;
uniform vec3 sun_direction;
uniform mat4 rot_mat;
uniform float time;
uniform float ks;
uniform float kd;
uniform float kr;
uniform float alpha;
uniform vec4 octaves;
uniform vec4 speeds;
uniform vec4 weights;
uniform vec4 colorWeights;
uniform vec4 cutoffs;
uniform mat4 colors;
uniform highp float seed;
uniform highp float range;

// Modified from http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/
vec4 rand(vec4 co)
{
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 10.1124;
    highp float d = 5.331;
    vec4 mult_vec = vec4(a,b,c,d);

    highp float e = 43758.5453;
    vec4 range_vec = vec4(range, range, range, range);
    vec4 new_co = vec4(100.0 * co.x, 100.0 * co.y, 100.0 * co.z, 100.0 * co.w);
    highp float dt = dot(new_co, mult_vec);
    highp float sn = mod(dt,3.14);
    highp float first = fract(sin(sn) * e);

    new_co = range_vec + new_co;
    dt= dot(new_co.xyz, mult_vec.xyz);
    sn= mod(dt,3.14);
    highp float second = fract(sin(sn) * e);

    new_co = range_vec + new_co;
    dt= dot(new_co.xyz, mult_vec.xyz);
    sn= mod(dt,.00314);
    highp float third = fract(sin(sn) * e);

    new_co = range_vec + new_co;
    dt= dot(new_co.xyz, mult_vec.xyz);
    sn= mod(dt,.00314);
    highp float fourth = fract(sin(sn) * e);

    return normalize(vec4(first, second, third, fourth));
}

vec3 updateVec(vec3 start_vec, int dim, int index, vec3 surface_position, float octave) {
    vec3 new_vec = start_vec;
    if (index == 0) {
        new_vec[dim] = float(floor(surface_position[dim] * octave)) / octave;
    } else {
        new_vec[dim] = float(ceil(surface_position[dim] * octave)) / octave;
    }

    return new_vec;
}

float basicInterpolate(vec2 vals, float t) {
    return vals[0] + t * (vals[1] - vals[0]); // vals[0] + (vals[1] - vals[0]) * (6.0 * pow(t, 5.0) - 15.0 * pow(t, 4.0) + 10.0 * pow(t, 3.0));
    // float st = t * 3.14159;
    // float f = (1.0 - cos(st)) * 0.5;
    // return vals[0] * (1.0 - f) + vals[1] * f;
}

float interpolate(vec3 surface_position, float octave, float speed) {
    vec2 vals0;
    float td = time * speed;

    for (int i = 0; i < 2; i++) {
        vec2 vals1;
        vec3 grid_position_1 = updateVec(surface_position, 0, i, surface_position, octave);

        for (int j = 0; j < 2; j++) {
            vec2 vals2;
            vec3 grid_position_2 = updateVec(grid_position_1, 1, j, surface_position, octave);

            for (int k = 0; k < 2; k++) {
                vec2 vals3;
                vec3 grid_position_3 = updateVec(grid_position_2, 2, k, surface_position, octave);

                for (int l = 0; l < 2; l++) {
                    float t = float(floor(td * octave)) / octave;
                    if (l == 1) {
                        t = float(ceil(td * octave)) / octave;
                    }

                    vec4 random_vector = rand(vec4(grid_position_3, t));
                    vals3[l] = dot(vec4(octave, octave, octave, octave) * (vec4(surface_position, td) - vec4(grid_position_3, t)), random_vector);
                }

                float t = mod(td * octave, 1.0);
                vals2[k] = basicInterpolate(vals3, t);
            }

            float t = mod(surface_position[2] * octave, 1.0);
            vals1[j] = basicInterpolate(vals2, t);
        }

        float t = mod(surface_position[1] * octave, 1.0);
        vals0[i] = basicInterpolate(vals1, t);
    }

    float t = mod(surface_position[0] * octave, 1.0);
    return basicInterpolate(vals0, t) * 0.5 + 0.5;
}

vec3 getColor(vec3 position, int max) {
    vec4 lum = vec4(0, 0, 0, 0);
    for (int i = 0; i < max; i++) {
        for (int j = 0; j < max; j++) {
                if (colorWeights[j] != 0.0) {
                    lum[j] += weights[i] * interpolate(position, octaves[i] + 0.01 * float(j), speeds[j]);
                }
        }
    }

    vec3 color = vec3(0, 0, 0);
    for (int i = 0; i < max; i++) {
        if (lum[i] > cutoffs[i]) {
            color += colors[i].xyz * lum[i] * colorWeights[i];
        }
    }
    return color;
}

vec3 bumpNormal() {
    float height = 3.0;
    float scale = 0.003;
    vec3 surface_position = normalize((rot_mat * vec4(local_position, 1.0)).xyz);
    vec3 up_position = normalize((rot_mat * vec4((normalize(local_position + vec3(0, scale, 0))), 1.0)).xyz);
    vec3 right_position = normalize((rot_mat * vec4((normalize(local_position + vec3(scale, 0, 0))), 1.0)).xyz);
    
    float true_lum = length(getColor(surface_position, 4));
    float up_lum = length(getColor(up_position, 4));
    float right_lum = length(getColor(right_position, 4));

    vec3 temp = normalize(global_normal);
    vec3 up_vec = normalize(temp+ vec3(0, scale, 0));
    vec3 right_vec = normalize(temp + vec3(scale, 0, 0));

    vec3 vert = (1.0 + scale * height * (up_lum - true_lum)) * up_vec - temp;
    vec3 horz = (1.0 + scale * height * (right_lum - true_lum)) * right_vec - temp;
    return normalize(-cross(vert, horz));
}


void main()
{
    vec3 bump_normal = bumpNormal();
    vec3 surface_position = normalize((rot_mat * vec4(local_position, 1.0)).xyz);
    vec3 lum = getColor(surface_position, 4);
    vec3 normal_sun = normalize(sun_direction);
    float sun_dot = dot(normal_sun, bump_normal);
    vec3 reflected_sun = vec3(2.0 * sun_dot, 2.0 * sun_dot, 2.0 * sun_dot) * bump_normal - bump_normal; 

    // A custom version of phong reflection.
    float scale = kd * sun_dot;

    if (dot(reflected_sun, camera_direction) > 0.0) {
        scale += ks * pow(dot(reflected_sun, camera_direction), alpha);
    }

    // Edge reflection
    scale += scale * kr * pow(1.0 - dot(camera_direction, bump_normal), 2.0);
    vec3 color_vec = scale * lum;
    gl_FragColor = vec4(color_vec, 1.0); // vec4(lum, lum, lum, 1.0);
}
`